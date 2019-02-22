Feature: Confirm card
    A customer provides his personal details and we should be able to derive the card number

  Background:
    Given I have started the app
    And   I can see attributes for card confirm

  Scenario Outline: Identify card by personal attributes
    Given I enter <firstname>, <surname>, <mobilenumber>, <IDNumber> 
    When  I click on the next step button
    Then  I see a loyalty card for action
    
    Examples:
      |	firstname	| surname	| mobilenumber	| IDNumber		|
      |	Alexander	| Watts		| +27-210000016	| 8603256131187	|   
