  Feature: Block a customer's card
    We should be able to block a customers card
  
  Scenario: Block loyalty card
    Given My active card is active 
    When  I click on the block button
    Then  I get confirmation that card is blocked